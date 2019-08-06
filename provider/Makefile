.PHONY: all build clean run build-docker

all: build

build:
	npm install

clean:
	rm -rf node_modules

run:
	npm start

build-docker:
	$(eval TMP := $(shell mktemp -d))
	cp -Lr Dockerfile node_modules secret src static $(TMP)

	(cd $(TMP) && docker build -t alias/provider .)
	rm -rf $(TMP)
