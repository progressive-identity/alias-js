#.PHONY: all build check build-nodejs build-web build-docker clean serve-client run npm-install clean-files build-docker serve
.PHONY: \
	all \
	build \
	build-client \
	build-processor \
	build-docker \
	build-docker-sandbox \
	check \
	run \
	run-client-server \
	run-processor-daemon

all: build

build: build-processor build-provider build-client

build-processor:
	make -C processor build

build-provider: build-anychain
	make -C provider build

build-client: build-anychain
	make -C client build

build-anychain:
	make -C anychain build

build-docker: build
	make -C processor/daemon build-docker
	make -C provider build-docker
	make -C client build-docker

build-docker-sandbox:
	docker build -t alias/sandbox -f docker/Dockerfile .

check:
	make -C processor check

clean:
	make -C client clean
	make -C provider clean
	make -C anychain clean
	make -C processor clean
	rm -rf root

### Debug run shortcuts

run:
	docker-compose -f docker/docker-compose.yml up

# set listening port with env var ALIAS_PROCESSOR_DAEMON_PORT
run-processor-daemon:
	make -C processor/daemon run

run-client-server:
	FLASK_APP=scripts/server.py FLASK_DEBUG=y flask run -h 0.0.0.0 -p 8081


