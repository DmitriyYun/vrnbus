import datetime
import logging
import unittest

from cds import CdsRequest
from data_providers import CdsTestDataProvider, CdsDBDataProvider
from data_types import CdsBusPosition, CdsRouteBus, BusStop
from helpers import parse_routes

logging.basicConfig(format='%(asctime)s - %(levelname)s [%(filename)s:%(lineno)s %(funcName)20s] %(message)s',
                    level=logging.INFO,
                    handlers=[logging.StreamHandler()])

logger = logging.getLogger("vrnbus")




class CdsRouteTestCase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(CdsRouteTestCase, self).__init__(*args, **kwargs)
        self.cds = CdsRequest(logger, None)
        self.date_time = datetime.datetime(2018, 2, 15, 19, 56, 53)

    def test_routes_on_bus_stop(self):
        result = self.cds.get_routes_on_bus_stop('у-м Молодежный (ул. Лизюкова в центр)')
        self.assertTrue(result)

    def test_bus_stop_distance(self):
        route_name = "5А"
        stop_1 = "у-м Молодежный (ул. Лизюкова в центр)"
        stop_2 = "ул. Лизюкова (ул. Жукова в центр)"

        with self.subTest('Normal bus station order'):
            result = self.cds.get_dist(route_name, stop_1, stop_2)
            self.assertTrue(result)

        with self.subTest('Reverse bus station order'):
            result = self.cds.get_dist(route_name, stop_2, stop_1)
            self.assertFalse(result)

    def test_closest_bus_stop_checked(self):
        route_name = '5А'
        pos_1 = CdsBusPosition(51.705497, 39.149543, self.date_time)  # у-м Молодёжный
        pos_2 = CdsBusPosition(51.705763, 39.155278, self.date_time)  # 60 лет ВЛКСМ

        with self.subTest('From city center '):
            result = self.cds.get_closest_bus_stop_checked(route_name, (pos_2, pos_1))
            self.assertTrue(result.NAME_ == 'у-м Молодежный (ул. Лизюкова из центра)')
            self.assertTrue(result.NUMBER_ == 61)

        with self.subTest('To city center '):
            result = self.cds.get_closest_bus_stop_checked(route_name, (pos_1, pos_2))
            self.assertTrue(result.NUMBER_ == 4)

    def test_closest_bus_stop_same_stations(self):
        positions = [CdsBusPosition(51.667033, 39.193648, self.date_time),
                     CdsBusPosition(51.672135, 39.187541, self.date_time),
                     CdsBusPosition(51.675065, 39.185286, self.date_time),
                     CdsBusPosition(51.677922, 39.184953, self.date_time),
                     CdsBusPosition(51.677922, 39.184953, self.date_time),
                     CdsBusPosition(51.680843, 39.184798, self.date_time)]

        result = self.cds.get_closest_bus_stop_checked("90", positions)

        self.assertTrue(result.NUMBER_ == 40)
        self.assertTrue(result.NAME_ == 'Проспект Труда (Московский проспект из центра)')

    def test_closest_bus_stop(self):
        route_bus = CdsRouteBus.make(*[
            51.625537, 39.177478,
            16,
            "2018-02-15T19:57:47",
            "М617АК136",
            834,
            20,
            "80",
            0,
            "2018-02-15T19:54:56",
            "Рабочий проспект (из центра)",
            None
        ])

        station = self.cds.get_closest_bus_stop(route_bus)
        logger.info(f"{station}; {route_bus.distance_km(station):.4f}  {route_bus.distance(station):.4f}")



class CdsDataGatheringTestCase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(CdsDataGatheringTestCase, self).__init__(*args, **kwargs)
        self.mock_provider = CdsTestDataProvider(logger)

    @unittest.skip("testing skipping")
    def test_db(self):
        self.db_provider = CdsDBDataProvider(logger)
        cds = CdsRequest(logger, self.db_provider)
        self.call_common_methods(cds)

    def test_mock(self):
        cds = CdsRequest(logger, self.mock_provider)
        self.call_common_methods(cds)

    def call_common_methods(self, cds):
        all_data = cds.load_all_cds_buses_from_db()
        cds.calc_avg_speed()

class CdsSpeedTestCase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(CdsSpeedTestCase, self).__init__(*args, **kwargs)
        logging.basicConfig(format='%(asctime)s - %(levelname)s [%(filename)s:%(lineno)s %(funcName)20s] %(message)s',
                            level=logging.INFO,
                            handlers=[logging.StreamHandler()])

        logger = logging.getLogger("vrnbus")
        self.mock_provider = CdsTestDataProvider(logger)
        self.cds = CdsRequest(logger, self.mock_provider)

    def test_speed_businfo(self):
        query = 'про 1КВ 1КС 3 3В 5 5А 6 6М 8 9КА 9КС 10А 11 13 14В 15 15А 16В 17 18 23К 25А 26А 27 33К Тр.7 Тр.8 Тр.11 Тр.17'
        search_request = parse_routes(query)
        start = datetime.datetime.now()
        result = self.cds.bus_request(search_request, short_format=True)
        logger.info("PING")
        finish = datetime.datetime.now()
        logger.info(f"{finish - start}")

class CdsBusStopIndexTestCase(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        logging.basicConfig(format='%(asctime)s - %(levelname)s [%(filename)s:%(lineno)s %(funcName)20s] %(message)s',
                            level=logging.INFO,
                            handlers=[logging.StreamHandler()])

        logger = logging.getLogger("vrnbus")
        self.mock_provider = CdsTestDataProvider(logger)
        self.cds = CdsRequest(logger, self.mock_provider)

    def test_get_index_by_name(self):
        result = self.cds.get_bus_stop_id("ул. Кирова (в центр)")
        self.assertIsInstance(result, int)

    def test_get_index_for_wrong_name(self):
        result = self.cds.get_bus_stop_id("NOT A STATION")
        self.assertIsInstance(result, int)
        self.assertEqual(result, -1)

    def test_get_bus_stop_for_index(self):
        result = self.cds.get_bus_stop_from_id(42)
        self.assertIsInstance(result, BusStop)

    def test_get_busstop_for_outrange_indexes(self):
        self.assertIsNone(self.cds.get_bus_stop_from_id(-1))
        self.assertIsNone(self.cds.get_bus_stop_from_id(100500))

    def test_routes_on_near_stations(self):
        # TODO: Find the test case for 49A
        routes_1 = self.cds.get_routes_on_bus_stop("Политехнический институт (из центра)")
        routes_2 = self.cds.get_routes_on_bus_stop("Рабочий проспект (из центра)")
        self.assertListEqual(routes_1, routes_2)

if __name__ == '__main__':
    unittest.main()
