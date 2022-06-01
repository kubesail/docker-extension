FROM alpine AS dl
WORKDIR /tmp
RUN apk add --no-cache curl tar
ARG TARGETARCH
RUN mkdir -p /out/darwin \
    && curl -fSsLo /out/darwin/kubectl "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/darwin/${TARGETARCH}/kubectl" \
    && chmod a+x /out/darwin/kubectl
RUN if [ "amd64" = "$TARGETARCH" ]; then \
        mkdir -p /out/windows && \
        curl -fSsLo /out/windows/kubectl.exe "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/windows/amd64/kubectl.exe"; \
    fi

FROM alpine
LABEL org.opencontainers.image.title="example-extension" \
    org.opencontainers.image.description="My Example Extension" \
    org.opencontainers.image.vendor="Docker Inc." \
    com.docker.desktop.extension.api.version=">= 0.1.0"

FROM node:17.7-alpine3.14 AS client-builder
WORKDIR /app/client
# cache packages in layer
COPY client/package.json /app/client/package.json
COPY client/yarn.lock /app/client/yarn.lock
ARG TARGETARCH
RUN yarn config set cache-folder /usr/local/share/.cache/yarn-${TARGETARCH}
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn-${TARGETARCH} yarn
# install
COPY client /app/client
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn-${TARGETARCH} yarn build

FROM alpine:3.15

LABEL org.opencontainers.image.title="KubeSail" \
    org.opencontainers.image.description="Helps you install and manage apps running inside Kubernetes on Docker." \
    org.opencontainers.image.vendor="Kubesail Inc." \
    com.docker.desktop.extension.api.version=">= 0.0.1" \
    com.docker.desktop.extension.icon="https://www.docker.com/wp-content/uploads/2022/03/Moby-logo.png" \
    com.docker.extension.screenshots='[{"alt":"Hello, Moby", "url":"https://docker-extension-screenshots.s3.amazonaws.com/minimal-backend/1-hello-moby.png"}]' \
    com.docker.extension.detailed-description="<h1>Description</h1><p>This is a sample extension that displays the text introduced in a textbox.</p>" \
    com.docker.extension.publisher-url="https://www.docker.com" \
    com.docker.extension.additional-urls='[{"title":"SDK Documentation","url":"https://docs.docker.com/desktop/extensions-sdk"}]' \
    com.docker.extension.changelog="<ul><li>Added metadata to provide more information about the extension.</li></ul>"

COPY hello.sh .
COPY metadata.json .
COPY icon.svg .
COPY --from=client-builder /app/client/dist ui
COPY --from=dl /out /

CMD [ "sleep", "infinity" ]
