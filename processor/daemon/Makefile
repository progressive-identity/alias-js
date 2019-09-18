.PHONY: all
all: build

.PHONY: build
build:
	npm install

.PHONY: run
run:
	npm start

.PHONY: clean
clean:
	rm -rf node_modules

.PHONY: build-docker
build-docker:
	$(eval TMP := $(shell mktemp -d))
	cp -Lr Dockerfile node_modules src $(TMP)

	(cd $(TMP) && docker build -t alias/processor .)
	rm -rf $(TMP)
