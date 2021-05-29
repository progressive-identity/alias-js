FROM node:16

RUN apt update && apt install -y \
    build-essential \
    curl \
    vim

# install nodemon
RUN npm install -g nodemon

# install rustup
#RUN curl -f -L https://static.rust-lang.org/rustup.sh -O && \
#    sh rustup.sh -y

WORKDIR /alias

