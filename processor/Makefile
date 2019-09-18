.PHONY: all
all: build

.PHONY: build
build: build-base build-daemon

.PHONY: build-base
build-base:
	make -C base

.PHONY: build-daemon
build-daemon:
	make -C daemon

.PHONY: check
check:
	make -C base check

.PHONY: clean
clean:
	make -C base clean
	make -C daemon clean
