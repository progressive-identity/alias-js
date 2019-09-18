.PHONY: all
all: build

.PHONY: build
build:
	npm install

.PHONY: clean
clean:
	rm -rf node_modules

.PHONY: run
run:
	npm start

.PHONY: build-docker
build-docker: build
	$(eval TMP := $(shell mktemp -d))
	cp -Lr Dockerfile node_modules secret src static $(TMP)

	(cd $(TMP) && docker build -t alias/provider .)
	rm -rf $(TMP)

.PHONY: up
up:
	docker-compose up
