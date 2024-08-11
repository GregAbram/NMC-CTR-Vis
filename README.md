# Containerized Vista

The Vista container is based on the **python:2.7**. This is a Debian version 10(buster) image, and is way out of date, but supports almost all necessary packages.

The big picture is that this container mounts two directories from the host file system.  The **data** directory contains the persistent Mongo and SQLite databases.  The **project** directory contains the Django web application.   At setup time we build the application container.   At run time we run this container, linking the host-side data and project directories into the image as **/data** and **vista** and exposing the web service port.

## Create vista user

Key to convenient interchange of permissions between the container and the host is a common user, agreeing in user and group UID's, on both the host and in the container.   To do this you first create a **vista** user on the host, then (below) modify the Dockerfile to create an eqivalent container-side user.  As superuser on the host:

		groupadd -r vista
		useradd -m -s /bin/bash -r -g vista foo
		echo "vista:passwd" | chpasswd
		
You can change the password as in the above to something else.   Now become the **vista** user.

		su - vista
		{authenticate}

## Prepare Data Directory

The Data directory is a host-side directory containing the Mongo database and the application
sqlite.db file.  This can be anywhere in the host filesystem; in this example its in the home directory of the vista user.   It (and its contents) should be owned and read/write/executable by the vista user

		ls ~/data
		sqlite.db  vista-db
		chown -R vista sqlite.db vista-db
		chmod -R 0700 sqlite.db vista-db
		
After the first run this directory will also contain log files.

## Building Vista Container

1. Create host-side installation project directory

		mkdir ~/vista
		cd ~/vista
		
2. Checkout source and change to **container** branch

		git clone https://github.com/GregAbram/NMC-CTR-Vis.git
		cd NMC-CTR-Vis
		git checkout container
		
3.  Return to project directory and create media and static directories

		cd ~/vista
		mkdir media
		mkdir static
		
4.  Enter the docker subdirectory of the cloned NMC-CTR-Vis project and build Docker image.  This installs almost everything from on-line packages, but mongo is installed from an included tar file.

		cd ~/vista/NMR-CTR-Vis/docker
		docker build -t vista .
		
## Running the web application

1.  In the docker subdirectory, run the container, linking the ../.. directory (eg. the directory in which the NMC-CTR-Vis git project was cloned) as /vista and the data directory (wherever, but in this example its in the 

		cd ~/vista

2.  Run the image under Docker:

		docker run -v `pwd`/../..:/vista -v {data directory}:/data -v 8000:8000 vista
		
	At this point Vista *should* be running and accessible at port 8000 from anywhere the host is visible.
		


		
		

		

		
