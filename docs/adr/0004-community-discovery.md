# ADR 0004 Community discovery through external ingestion

## Status

Accepted for implementation on 2026-11-08. Live Muse operation and the selection of real source groups are managed by the product owner after delivery.

## Context

Voi has native group coordination and a web client, but an early visitor needs useful badminton opportunities before hosts have adopted the product. The product owner will use a separate Muse AI skill to collect and normalize community posts. Voi needs a bounded integration API and anonymous discovery/contact experience.

## Decision

Add a separate community listing catalogue. Bot credentials carry explicit source scopes; source publication is controlled by an operator. Listings preserve source identity, freshness and reported availability, with external contact actions. They do not create native hosts, groups, RSVP participants, payments or ownership claims.

Launch anonymous discovery on the existing web client. Keep native session contracts and private group access intact. The original product documents' exclusion of public discovery is superseded for this limited experiment; venue booking, marketplace payments and unrestricted automated social posting remain outside scope.

The implementation contract and acceptance criteria are in [spec 0015](../specs/0015-community-listings/spec.md). Share-poster generation is a later feature. Muse source access and messages on Facebook are not performed by the Voi backend.

## Consequences

- Hosts can receive enquiries without creating a Voi account.
- Separate public DTOs avoid exposing rosters and private coordination data.
- Observations and expiry are explicit; a contact click never implies a reserved place.
- Operators must configure sources and handle correction/removal requests.
- External bot quality and actual successful connections require a real-source pilot after API/web verification.
