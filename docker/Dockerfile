FROM debian

RUN apt update && apt install -y \
    build-essential \
    curl \
    vim

# install node.js
RUN curl -sL https://deb.nodesource.com/setup_11.x | bash - && \
    apt install -y nodejs

# install nodemon
RUN npm install -g nodemon

# install rustup
#RUN curl -f -L https://static.rust-lang.org/rustup.sh -O && \
#    sh rustup.sh -y

WORKDIR /alias

