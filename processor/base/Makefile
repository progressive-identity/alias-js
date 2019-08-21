.PHONY: all
all: build

.PHONY: build
build: build-rust
	make -C js

.PHONY: build-rust
build-rust:
	make -C rust

.PHONY: check
check:
	make -C rust check

.PHONY: clean
clean:
	make -C rust clean
	make -C js clean
