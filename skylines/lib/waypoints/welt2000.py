import os
import subprocess

from tg import config
from skylines.lib.waypoints.welt2000_reader import parse_welt2000_waypoints

def __get_database_file(dir_data):
    path = os.path.join(dir_data, 'welt2000', 'WELT2000.TXT')

    # Create Welt2000 data folder if necessary
    if not os.path.exists(os.path.dirname(path)):
        os.makedirs(os.path.dirname(path))

    # Download the current file
    # (only if server file is newer than local file)
    url = 'http://www.segelflug.de/vereine/welt2000/download/WELT2000.TXT'
    subprocess.check_call(['wget', '-N', '-P', os.path.dirname(path), url])

    # Check if download succeeded
    if not os.path.exists(path):
        raise RuntimeError('Welt2000 database not found at {}'.format(path))

    # Return path to the Welt2000 file
    return path

def get_database(bounds = None):
    # Get Welt2000 file
    path = __get_database_file(config['skylines.assets.path'])

    # Parse Welt2000 file
    with open(path, "r") as f:
        # Return parsed WaypointList
        return parse_welt2000_waypoints(f, bounds)

