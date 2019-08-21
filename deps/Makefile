.PHONY: all
all: build

.PHONY: build
build: build-anychain

.PHONY: build-anychain
build-anychain:
	(cd anychain-js && npm install)

.PHONY: clean
clean:
	rm -rf anychain-js/node_modules

