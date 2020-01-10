FROM node:carbon

ENV REDIS_URL redis://redis:6379/nachtigaller
ENV HUBOT_LOG_LEVEL error
ENV HUBOT_DISCOURSE_USERNAME username
ENV HUBOT_DISCOURSE_KEY secret
ENV HUBOT_DISCOURSE_SERVER https://discourse.example.com/

RUN git clone https://github.com/soudis/discourse-nachtigaller.git
WORKDIR /discourse-nachtigaller

RUN chmod +x bin/hubot
RUN npm install

CMD bin/hubot -a discourse-adapter -n abdul_nachtigaller -d