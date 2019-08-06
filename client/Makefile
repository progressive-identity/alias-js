.PHONY: all build clean run build-docker clean-files

all: build

build:
	npm install

clean:
	rm -rf node_modules

run:
	npm start

build-docker:
	$(eval TMP := $(shell mktemp -d))
	cp -Lr Dockerfile node_modules src static $(TMP)

	(cd $(TMP) && docker build -t alias/client .)
	rm -rf $(TMP)

clean-files:
	rm -rf data/*
	mkdir -p data/files
