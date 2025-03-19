FROM python:2.7

RUN pip install uwsgi

RUN apt-get update && \
    apt-get install -y \
        build-essential \
        wget \
        curl \
        vim  \
        sqlite3 \
        nginx \
        python2-dev \
        sudo \
        strace

RUN pip install \
        Django==1.10 \
        pymongo==2.6.3 \
        numpy \
        scipy \
        pyparsing 

RUN groupadd -r sudoers  \
    && groupadd -r -g 1003 vista  \
    && groupadd -r -g 1004 nginx  \
    && useradd -m -s /bin/bash -r -g vista -u 1003 -G sudoers vista \
    && useradd -m -s /bin/bash -r -g nginx -u 1004 -G sudoers nginx
   
RUN mkdir -p /vista \
    && cd /vista \
    && git clone https://github.com/GregAbram/NMC-CTR-Vis \
    && cd NMC-CTR-Vis \
    && git checkout container

COPY  vista_nginx.conf /etc/nginx/sites-available/vista_nginx.conf 
RUN ln -s /etc/nginx/sites-available/vista_nginx.conf /etc/nginx/sites-enabled/

RUN curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh \
    && apt-get install git-lfs

RUN cd /usr/local \
    && git clone https://github.com/GregAbram/NMC-CTR-Vis \
    && cd NMC-CTR-Vis \
    && git checkout container 

RUN cd /usr/local \
    && tar xzf /usr/local/NMC-CTR-Vis/docker/mongodb-linux-x86_64-2.6.12.tgz 

RUN chown root:root /usr/bin/sudo && chmod 4755 /usr/bin/sudo

ENTRYPOINT ["/bin/bash", "/usr/local/NMC-CTR-Vis/docker/start.sh"]

