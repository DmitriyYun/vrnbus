(function () {
    "use strict";

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
    }

    var l_map;
    var marker_group;
    var coords = {latitude: 51.6754966, longitude: 39.2088823}

    var lastbusquery = document.getElementById('lastbusquery')
    var station_query = document.getElementById('station_query')
    var station_name = document.getElementById('station_name')

    var timer_id = 0
    var timer_stop_id = 0

    var info = document.getElementById('info')
    var businfo = document.getElementById('businfo')
    var lastbus = document.getElementById('lastbus')
    var nextbus_loading = document.getElementById('nextbus_loading')
    var lastbus_loading = document.getElementById('lastbus_loading')
    var cb_refresh = document.getElementById('cb_refresh')
    var cb_show_info = document.getElementById('cb_show_info')
    var btn_station_search = document.getElementById('btn_station_search')

    var bus_stop_list = []
    var bus_stop_names = []
    var bus_stop_auto_complete

    if (lastbus)
        lastbus.onclick = function () {
            get_cds_bus()
        }

    if (cb_refresh)
        cb_refresh.onclick = function () {
            if (!cb_refresh.checked) {
                clearTimeout(timer_id)
                clearTimeout(timer_stop_id)
                timer_id = 0
                timer_stop_id = 0
            }
        }

    if (cb_show_info) {
        cb_show_info.onclick = function () {
            var show = cb_show_info.checked
            businfo.className = show ? "" : "hide_info"
        }
    }

    if (btn_station_search) {
        btn_station_search.onclick = function () {
            run_search_by_name()
        }
    }
    if (lastbusquery) {
        lastbusquery.onkeyup = function (event) {
            event.preventDefault()
            if (event.keyCode === 13) {
                get_cds_bus()
            }
        }
    }

    if (station_query) {
        station_query.onkeyup = function (event) {
            event.preventDefault()
            if (event.keyCode === 13) {
                run_search_by_name()
            }
        }
    }

    if (station_name) {
        station_name.onkeyup = function (event) {
            event.preventDefault()
            if (event.keyCode === 13) {
                run_search_by_name()
            }
        }
    }

    function run_timer(func) {
        if (cb_refresh.checked && !timer_id) {
            timer_id = setTimeout(function tick() {
                func().then(function () {
                    if (cb_refresh.checked)
                        timer_id = setTimeout(tick, 30 * 1000)
                })
            }, 30 * 1000)
            if (!timer_stop_id)
                timer_stop_id = setTimeout(function () {
                    cb_refresh.checked = false
                    clearTimeout(timer_id)
                    timer_id = 0
                    timer_stop_id = 0

                }, 10 * 60 * 1000)
        }
    }

    function setCookie(name, value, options) {
        options = options || {};

        var expires = options.expires;

        if (typeof expires == "number" && expires) {
            var d = new Date();
            d.setTime(d.getTime() + expires * 1000);
            expires = options.expires = d;
        }
        if (expires && expires.toUTCString) {
            options.expires = expires.toUTCString();
        }

        value = encodeURIComponent(value);

        var updatedCookie = name + "=" + value;

        for (var propName in options) {
            updatedCookie += "; " + propName;
            var propValue = options[propName];
            if (propValue !== true) {
                updatedCookie += "=" + propValue;
            }
        }

        document.cookie = updatedCookie;
    }

    function getCookie(name) {
        var matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    function run_search_by_name() {
        run_timer(run_search_by_name)
        return get_bus_stop_by_name()
    }

    function update_user_position() {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(function (position) {
                coords = position.coords
            })
        }
    }

    if ("geolocation" in navigator) {
        var nextbus = document.getElementById('nextbus')

        if (nextbus)
            nextbus.onclick = function (event) {
                event.preventDefault()
                get_current_pos(get_bus_arrival)
            }
    }

    function save_station_params() {
        var query = station_query.value
        var station = station_name.value

        save_to_ls('station_query', query)
        save_to_ls('station', station)
    }

    function get_current_pos(func) {
        save_station_params()

        navigator.geolocation.getCurrentPosition(func)
    }

    function format_bus_stops(header, bus_stops) {
        var bus_stop_info = header + '\n'
        for (var prop in bus_stops) {
            bus_stop_info += '<a class="bus_linked" href="">' + prop + '</a>' + '\n' + bus_stops[prop] + '\n'
        }

        info.innerHTML = bus_stop_info
        var elements = document.getElementsByClassName('bus_linked')
        for (var i = 0; i < elements.length; i++) {
            elements[i].onclick = function (e) {
                e.preventDefault()
                if (e.srcElement && e.srcElement.text) {
                    station_name.value = e.srcElement.text
                    get_bus_arrival_by_name()
                }
            }
        }
    }

    function get_bus_stop_by_name() {
        var btn_station_search = document.getElementById('btn_station_search')
        waiting(nextbus_loading, btn_station_search, true)

        var bus_query = station_query.value
        var station = station_name.value

        save_station_params()

        var params = 'q=' + encodeURIComponent(bus_query) +
            '&station=' + encodeURIComponent(station)

        return fetch('/bus_stop_search?' + params,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
            })
            .then(function (res) {
                return res.json()
            })
            .then(function (data) {
                update_cookies()
                waiting(nextbus_loading, btn_station_search, false)
                format_bus_stops(data.header, data.bus_stops)
            })
            .catch(function (error) {
                waiting(nextbus_loading, btn_station_search, false)
                info.innerHTML = 'Ошибка: ' + error
            })
    }

    function waiting(element, button, state) {
        element.className = state ? 'spinner' : ''
        button.disabled = state
    }


    function get_bus_stop_list() {
        return fetch('/bus_stops',
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
            })
            .then(function (res) {
                return res.json()
            })
            .then(function (data) {
                update_cookies()
                bus_stop_list = data.result
                bus_stop_names = bus_stop_list.map(function callback(bus_stop) {
                    return bus_stop.NAME_
                })
                if (station_name) {
                    bus_stop_auto_complete = new autoComplete({
                        selector: station_name,
                        source: function (term, suggest) {
                            term = term.toLowerCase();
                            var matches = [];
                            for (var i = 0; i < bus_stop_names.length; i++)
                                if (~bus_stop_names[i].toLowerCase().indexOf(term)) matches.push(bus_stop_names[i]);
                            suggest(matches);
                        }
                    })
                }

                marker_group.clearLayers()
                bus_stop_list.forEach(function (item) {
                    L.marker([item.LAT_, item.LON_], {
                        opacity: 0.5
                    }).on('click', function (e) {
                        var new_opacity = this.options.opacity < 1 ? 1 : 0.5
                        this.setOpacity(new_opacity)
                        var icon =  L.icon({iconUrl: "busstop.png", iconSize: [25, 25],})
                        this.setIcon(icon)
                    }).
                    addTo(marker_group)
                        .bindTooltip(item.NAME_ + " (id: " + item.ID + ")");

                })

            })
    }

    function update_cookies() {
        var user_ip = getCookie("user_ip")
        if (user_ip) {
            save_to_ls("user_ip", user_ip)
        }
    }

    function save_to_ls(key, value) {
        if (!ls_test()) {
            return
        }
        localStorage.setItem(key, value)
    }

    function load_from_ls(key) {
        if (!ls_test()) {
            return
        }
        return localStorage.getItem(key)
    }

    function ls_test() {
        var test = 'test'
        if (!'localStorage' in window) {
            return false
        }
        try {
            localStorage.setItem(test, test)
            localStorage.removeItem(test)
            return true
        } catch (e) {
            return false
        }
    }

    function init() {
        var user_ip = getCookie("user_ip")
        var ls_user_ip = load_from_ls('user_ip')
        if (!user_ip && ls_user_ip) {
            setCookie("user_ip", ls_user_ip, {expires: 3600 * 24 * 7})
        }
        if (station_name) {
            get_bus_stop_list()
        }


        if (station_name)
            station_name.value = load_from_ls('station') || ''

        l_map = L.map('mapid').setView([51.6754966, 39.2088823], 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(l_map)
        marker_group = L.layerGroup().addTo(l_map);
    }

    document.addEventListener("DOMContentLoaded", init);
})()