I want 3 pods/containers

postgres
server
client


# Postgres Run

```bash

docker run --name postgres -e POSTGRES_USERNAME=postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres

docker build -t web-svelte .

docker run --name web -p 80:80 -d web-svelte

```
