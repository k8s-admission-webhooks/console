FROM quay.io/coreos/tectonic-console-builder:v20 AS build

RUN mkdir -p /go/src/github.com/k8s-admission-webhooks/console/
ADD . /go/src/github.com/k8s-admission-webhooks/console/
WORKDIR /go/src/github.com/k8s-admission-webhooks/console/
RUN ./build.sh

FROM openshift/origin-base

COPY --from=build /go/src/github.com/k8s-admission-webhooks/console/frontend/public/dist /opt/bridge/static
COPY --from=build /go/src/github.com/k8s-admission-webhooks/console/bin/bridge /opt/bridge/bin/bridge
COPY --from=build /go/src/github.com/k8s-admission-webhooks/console/pkg/graphql/schema.graphql /pkg/graphql/schema.graphql

LABEL io.k8s.display-name="OpenShift Console" \
      io.k8s.description="This is a component of OpenShift Container Platform and provides a web console." \
      io.openshift.tags="openshift" \
      maintainer="Samuel Padgett <spadgett@redhat.com>"

# doesn't require a root user.
USER 1001

CMD [ "/opt/bridge/bin/bridge", "--public-dir=/opt/bridge/static" ]
