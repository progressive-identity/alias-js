FROM node:16

RUN apt update && apt install -y curl

#ENV OPENSSL_LIB_DIR=/usr/lib \
#    OPENSSL_INCLUDE_DIR=/usr/include/openssl

# Install rustup
RUN curl https://sh.rustup.rs -sSf | \
    sh -s -- --default-toolchain nightly -y
ENV PATH=/root/.cargo/bin:$PATH

# Install target wasm
RUN rustup target add wasm32-unknown-unknown

# Install CLI tool wasm-bindgen
RUN cargo install --version 0.2.74 wasm-bindgen-cli

#RUN pacman --noconfirm -Sy \
#    clang \
#    gcc \
#    grep \
