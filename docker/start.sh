/usr/local/mongodb-linux-x86_64-2.6.12/bin/mongod  -dbpath=/data/vista-db > /data/mongo.log 2>&1  &
/etc/init.d/nginx start

cd /vista
test ! -e .secret_key && python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())' > .secret_key
export SECRET_KEY=`cat .secret_key`

cd NMC-CTR-Vis
echo 'yes' | python2 manage.py collectstatic

sed -i  '/sendfile/i uwsgi_read_timeout 600s;' /etc/nginx/nginx.conf

uwsgi --socket ../vista.sock --wsgi-file NMC/wsgi.py --uid vista --chmod-socket=666 > /data/uwsgi.log 2>&1 
