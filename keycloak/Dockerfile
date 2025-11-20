# region Global args
# Custom Keycloak image with Group Resource Policy Provider extension
ARG KEYCLOAK_VERSION="26.4.5"
ARG KEYCLOAK_EXTRA_ARGS="-Dkeycloak.client.searchableAttributes=organization-id,is-deleted,user-id,partner-id -Dkeycloak.user.searchableAttributes=owner-user,is-deleted,invitation-code -Dkeycloak.organization.searchableAttributes=easydmarcOrganizationId"
# endregion

# region Build images
FROM maven:3.9.9-amazoncorretto-21-alpine AS provider-builder
ARG KEYCLOAK_VERSION

WORKDIR /build
RUN mkdir /providers

ADD . ./

RUN mvn clean install -Dversion=$KEYCLOAK_VERSION
RUN find ./extensions -name "*$KEYCLOAK_VERSION-jar-with-dependencies.jar" -exec mv -t /providers {} +
RUN rm -rf /build

# region Runtime images
FROM quay.io/keycloak/keycloak:$KEYCLOAK_VERSION AS prod

ENV KC_METRICS_ENABLED=true
ENV KC_HEALTH_ENABLED=true
ENV KC_FEATURES=preview
ENV KEYCLOAK_EXTRA_ARGS_PREPENDED=""

ARG KEYCLOAK_EXTRA_ARGS
ENV KEYCLOAK_EXTRA_ARGS=$KEYCLOAK_EXTRA_ARGS

COPY --chown=keycloak:root --from=provider-builder /providers/* /opt/keycloak/providers/

# Build Keycloak with custom providers and PostgreSQL support for --optimized flag
# Pre-configure database vendor to match runtime configuration from operator
RUN /opt/keycloak/bin/kc.sh build --db=postgres
