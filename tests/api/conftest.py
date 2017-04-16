from flask import Flask
import pytest
from werkzeug.datastructures import Headers

import config
from skylines import create_api_app


@pytest.fixture(scope="session")
def app():
    """Set up global front-end app for functional tests

    Initialized once per test-run
    """
    return create_api_app(config.TESTING_CONF_PATH)


@pytest.fixture(scope="function")
def client(app):
    """
    A ``flask.testing.FlaskClient`` for API integration testing.
    """
    assert isinstance(app, Flask)
    return app.test_client()


@pytest.fixture(scope="function")
def default_headers():
    headers = Headers()
    headers.add('User-Agent', 'py.test')
    return headers
