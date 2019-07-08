.PHONY: all build build-nodejs build-web clean serve run npm-install

NAME=alias_rs

RUST_SRC=$(shell find src -type f -name '*.rs')
RUST_TARGET ?= wasm32-unknown-unknown
CARGO_FLAGS = --target $(RUST_TARGET)
RELEASE ?= y

ifeq ($(RELEASE), y)
	TARGET_PATH=target/$(RUST_TARGET)/release
	CARGO_FLAGS += --release
else
	TARGET_PATH=target/$(RUST_TARGET)/debug
endif

WASM_PATH=$(TARGET_PATH)/$(NAME).wasm
NODEJS_TARGET_PATH=$(TARGET_PATH)/nodejs
WEB_TARGET_PATH=$(TARGET_PATH)/web

all: build npm-install

build: build-nodejs build-web

build-nodejs: $(WASM_PATH)
	rm -rf $(NODEJS_TARGET_PATH)
	wasm-bindgen $(WASM_PATH) --out-dir $(NODEJS_TARGET_PATH) --target nodejs

build-web: $(WASM_PATH)
	rm -rf $(WEB_TARGET_PATH)
	wasm-bindgen $(WASM_PATH) --out-dir $(WEB_TARGET_PATH) --target no-modules

$(WASM_PATH): $(RUST_SRC)
	cargo build $(CARGO_FLAGS)

dist/www:
	cargo build $(CARGO_FLAGS)
	wasm-bindgen $(WASM_PATH) --out-dir ./dist --target nodejs --no-typescript
	rm -rf www/dist && mv dist www
	ls -lha www/dist/alias_*

npm-install:
	(cd js && npm install)

run:
	@(cd js && node app.js)

clean:
	cargo clean
	rm -rf js/node_modules
#	rm -rf www/dist

#serve: build
#	(cd www && http-server)

