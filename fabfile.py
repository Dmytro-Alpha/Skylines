from fabric.api import env, task, local, cd, lcd, run, sudo, put

from tempfile import NamedTemporaryFile

env.use_ssh_config = True
env.hosts = ['skylines@skylines']

APP_DIR = '/home/skylines'
SRC_DIR = '%s/src' % APP_DIR


@task
def deploy(branch='master', force=False):
    build_ember()
    upload_ember()
    push(branch, force)
    bower_install()
    restart()


@task
def build_ember():
    with lcd('ember'):
        local('node_modules/.bin/ember build -prod -o dist/')


@task
def upload_ember():
    with cd(SRC_DIR):
        run('mkdir -p skylines/frontend/static/ember')
        put('ember/dist/*', 'skylines/frontend/static/ember')


@task
def push(branch='HEAD', force=False):
    cmd = 'git push %s:%s %s:master' % (env.host_string, SRC_DIR, branch)
    if force:
        cmd += ' --force'

    local(cmd)


@task
def restart():
    with cd(SRC_DIR):
        run('git reset --hard')

        # compile i18n .mo files
        manage('babel compile')

        # generate JS/CSS assets
        manage('assets build')

        # do database migrations
        manage('migrate upgrade')

        # restart services
        restart_service('skylines-api')
        restart_service('skylines')
        restart_service('mapserver')
        restart_service('tracking')
        restart_service('celery')
        restart_service('mapproxy')


@task
def restart_service(service):
    # Using the sudo() command somehow always provokes a password prompt,
    # even if NOPASSWD is specified in the sudoers file...
    run('sudo supervisorctl restart %s' % service)


@task
def manage(cmd, user=None):
    with cd(SRC_DIR):
        if user:
            sudo('./manage.py %s' % cmd, user=user)
        else:
            run('./manage.py %s' % cmd)


@task
def update_mapproxy():
    with NamedTemporaryFile() as f:
        content = open('mapserver/mapproxy/mapproxy.yaml').read()

        content = content.replace(
            'base_dir: \'/tmp/cache_data\'',
            'base_dir: \'%s/cache/mapproxy\'' % APP_DIR,
        )

        content = content.replace(
            'lock_dir: \'/tmp/cache_data/tile_locks\'',
            'lock_dir: \'%s/cache/mapproxy/tile_locks\'' % APP_DIR,
        )

        f.write(content)
        f.flush()

        put(f.name, '%s/config/mapproxy.yaml' % APP_DIR)


@task
def pip_install():
    with cd(SRC_DIR):
        run('git reset --hard')
        run('pip install -e .')


@task
def bower_install():
    with cd(SRC_DIR + '/ember'):
        run('bower install')


@task
def clean_mapproxy_cache():
    with cd('/home/skylines/cache/mapproxy'):
        run('rm -rv *')
