FROM node

ENV REDIS_URL redis://redis:6379/nachtigaller

RUN git clone https://github.com/soudis/discourse-nachtigaller.git
WORKDIR /discourse-nachtigaller

RUN chmod +x bin/hubot

CMD bin/hubot -a discourse-adapter -n abdul_nachtigaller -d