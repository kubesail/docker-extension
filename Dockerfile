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
    com.docker.desktop.extension.icon="https://kubesail.com/og-logo-1200.png" \
    com.docker.extension.screenshots='[{"alt":"KubeSail", "url":"https://i.imgur.com/uxYABlK.png"}]' \
    com.docker.extension.detailed-description="<h1>KubeSail</h1><p>The KubeSail Docker extension allows you to install self-hosted apps on Docker Desktop.</p>" \
    com.docker.extension.publisher-url="https://kubesail.com" \
    com.docker.extension.additional-urls='[{"title":"Privacy Policy","url":"https://kubesail.com/privacy"},{"title":"Terms of Service","url":"https://kubesail.com/terms"}]' \
    com.docker.extension.changelog="<ul><li>Added metadata to provide more information about the extension.</li></ul>"

COPY metadata.json .
COPY icon.svg .
COPY --from=client-builder /app/client/dist ui
COPY --from=dl /out /

CMD [ "sleep", "infinity" ]
