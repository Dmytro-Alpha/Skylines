from tests.api import auth_for
from tests.data import users


def test_delete_user(client, test_user):
    res = client.get('/users/{id}'.format(id=test_user.id))
    assert res.status_code == 200

    res = client.delete('/users/{id}'.format(id=test_user.id), headers=auth_for(test_user), json={
        'password': test_user.original_password,
    })
    assert res.status_code == 200
    assert res.json == {}

    res = client.get('/users/{id}'.format(id=test_user.id))
    assert res.status_code == 404


def test_delete_user_with_wrong_password(client, test_user):
    res = client.delete('/users/{id}'.format(id=test_user.id), headers=auth_for(test_user), json={
        'password': 'wrong-password',
    })
    assert res.status_code == 403


def test_delete_user_with_missing_password(client, test_user):
    res = client.delete('/users/{id}'.format(id=test_user.id), headers=auth_for(test_user))
    assert res.status_code == 400


def test_delete_user_as_admin(client, test_user, test_admin):
    res = client.get('/users/{id}'.format(id=test_user.id))
    assert res.status_code == 200

    res = client.delete('/users/{id}'.format(id=test_user.id), headers=auth_for(test_admin))
    assert res.status_code == 200
    assert res.json == {}

    res = client.get('/users/{id}'.format(id=test_user.id))
    assert res.status_code == 404


def test_delete_user_as_other_user(db_session, client, test_user):
    john = users.john()
    db_session.add(john)
    db_session.commit()

    res = client.delete('/users/{id}'.format(id=test_user.id), headers=auth_for(john))
    assert res.status_code == 403


def test_delete_missing_user(client, test_user):
    res = client.delete('/users/1', headers=auth_for(test_user))
    assert res.status_code == 404


def test_delete_user_with_invalid_id(client, test_user):
    res = client.delete('/users/abc', headers=auth_for(test_user))
    assert res.status_code == 404


def test_delete_user_without_authentication(client):
    res = client.delete('/users/1')
    assert res.status_code == 401


def test_delete_user_invalidates_auth_tokens(client, test_user):
    res = client.get('/settings'.format(id=test_user.id), headers=auth_for(test_user))
    assert res.status_code == 200

    res = client.delete('/users/{id}'.format(id=test_user.id), headers=auth_for(test_user), json={
        'password': test_user.original_password,
    })
    assert res.status_code == 200
    assert res.json == {}

    res = client.get('/settings'.format(id=test_user.id), headers=auth_for(test_user))
    assert res.status_code == 401
