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

	(cd $(TMP) && docker build -t alias/client .)
	rm -rf $(TMP)

.PHONY: clean-files
clean-files:
	rm -rf data/*
	mkdir -p data/files
