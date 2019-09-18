.PHONY: all
all: build

.PHONY: build
build: build-processor build-provider build-client

.PHONY: build-processor
build-processor: build-deps
	make -C processor build

.PHONY: build-provider
build-provider: build-deps
	make -C provider build

.PHONY: build-client
build-client: build-deps
	make -C client build

.PHONY: build-deps
build-deps:
	make -C deps build

.PHONY: build-docker
build-docker:
	make -C processor/daemon build-docker
	make -C provider build-docker
	make -C client build-docker

.PHONY: build-docker-sandbox
build-docker-sandbox:
	docker build -t alias/sandbox -f docker/Dockerfile .

.PHONY: check
check:
	make -C processor check

.PHONY: clean
clean:
	make -C client clean
	make -C provider clean
	make -C deps clean
	make -C processor clean
	rm -rf root

.PHONY: build-docker-builder
build-docker-builder:
	docker build -t alias/builder -f docker/Dockerfile.builder docker

.PHONY: build-inside-docker
build-inside-docker:
	docker run --rm -it -v `pwd`:/pwd alias/builder /usr/bin/make -C /pwd

### Debug run shortcuts

.PHONY: up
up:
	docker-compose -f docker/docker-compose.yml up

# set listening port with env var ALIAS_PROCESSOR_DAEMON_PORT
.PHONY: run-processor-daemon
run-processor-daemon:
	make -C processor/daemon run

.PHONY: run-client-server
run-client-server:
	make -C client run

# set listening port with env var ALIAS_AUTHZ_PORT
.PHONY: run-provider-server
run-provider-server:
	make -C provider run

.PHONY: run-sandbox
run-sandbox:
	docker run -it --rm -v `pwd`:/alias alias/sandbox /bin/bash
