#!/bin/sh

exec sudo -u mapserver /opt/skylines/src/fastcgi_mapserver.py --logfile=/var/log/mapserver/console
