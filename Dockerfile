FROM node:15

RUN mkdir /vremtally
WORKDIR  /vremtally
COPY ./src/ /vremtally/src
COPY package.json /vremtally/
RUN yarn
EXPOSE 5001

ENTRYPOINT ["node", "src/index"]