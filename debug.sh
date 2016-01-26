#!/bin/bash
#
# Prepares and launces the stand-alone debugging SkyLines server.
#

set -e

cd `dirname $0`
python generate_assets.py

if test -z "$@"; then
    paster serve --reload development.ini
else
    paster serve --reload "$@"
fi
