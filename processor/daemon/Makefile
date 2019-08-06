.PHONY: all build clean run build-docker

all: build

build:
	npm install

run:
	npm start

clean:
	rm -rf node_modules

build-docker:
	$(eval TMP := $(shell mktemp -d))
	cp -Lr Dockerfile node_modules app.js $(TMP)

	(cd $(TMP) && docker build -t alias/processor .)
	rm -rf $(TMP)
