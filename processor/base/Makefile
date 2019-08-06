.PHONY: all build build-rust clean check

all: build

build: build-rust
	make -C js

build-rust:
	make -C rust

check:
	make -C rust check

clean:
	make -C rust clean
	make -C js clean
