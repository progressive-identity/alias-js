FROM archlinux/base

RUN pacman --noconfirm -Sy \
    clang \
    gcc \
    grep \
    make \
    nodejs \
    npm

ENV OPENSSL_LIB_DIR=/usr/lib \
    OPENSSL_INCLUDE_DIR=/usr/include/openssl

# Install rustup
RUN curl https://sh.rustup.rs -sSf | \
    sh -s -- --default-toolchain stable -y
ENV PATH=/root/.cargo/bin:$PATH

# Install target wasm
RUN rustup target add wasm32-unknown-unknown

# Install CLI tool wasm-bindgen
RUN cargo install --version 0.2.50 wasm-bindgen-cli

