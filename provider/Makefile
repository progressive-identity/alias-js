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
build-docker:
	$(eval TMP := $(shell mktemp -d))
	cp -LR Dockerfile node_modules src static $(TMP)

	(cd $(TMP) && docker build -t alias/provider .)
	rm -rf $(TMP)

.PHONY: up
up:
	docker-compose up
