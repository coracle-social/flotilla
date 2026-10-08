---
title: "Self Hosting a Space"
author: "Jon Staab"
pubDate: 2026-07-14
slug: self-hosting-a-space
source: https://flotilla.social/articles/self-hosting-a-space
description: "Provision a server, run the zooid relay behind nginx, and connect your self-hosted space to Flotilla."
order: 28
category: advanced
---

# Self Hosting a Space

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

Nostr identifies users with cryptographic identities, so your social identity can't be taken away from you. Keep a backup of your events and you're safe from losing your content and social graph too. But someone still has to run the servers.

For a regular Nostr user, self-hosting is mostly a nice-to-have. But if you're a community organizer, people depend on you to keep their content private and secure. Depending on the size of your community and your own technical skill, it may be worth running your space on infrastructure you control.

### Getting a Server

This tutorial uses [BitLaunch](https://bitlaunch.io/), which offers domains and servers KYC-free and payable in bitcoin. Any server provider you're comfortable with will work.

![](/images/FyrFqFsfysmmK2q0tlLaWjeAOo.png)

Once you've confirmed your email and deposited some bitcoin, click "Create a Server". We'll go with the default settings here: a BitLaunch Ubuntu 24.04 $11/mo VPS.

![](/images/ZYaJAhWu0PMRihLXvRpQqUcBA.png)

For access, you can pick a password or upload your ssh public key. An ssh key is more secure and more convenient, but you can start with a password and switch to ssh later. See [here](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent) for directions on setting one up.

![](/images/QWyIeLZHaRzPFB6cvtG7r7Qe9uc.png)

When everything looks good, click "Launch Server" at the bottom of the page. The server takes a few minutes to boot, so now is a good time to set up your domain. You can use any DNS provider you like; I'll use [namecheap](https://www.namecheap.com/).

Open your domain list and click "Manage" next to the domain you want to host your relay on. Then click "Advanced DNS", followed by "Add New Record".

![](/images/ARQbqCvphnXawScCrwtD9tGfRzs.png)

Choose "A Record" and enter your new server's IP address in the "IP Address" field. If you're using the domain itself, enter `@` in the "Host" field; otherwise enter the subdomain. (For example, to make your relay available at "relay.yourdomain.com", enter "relay".)

![](/images/UeQJm3JtQGPpZ86Td329gQ2QkE.png)

Click the check mark button to save the record.

Once the VPS finishes booting, click to copy the `ssh <your ip address>` command and paste it into your [terminal](https://www.freecodecamp.org/news/command-line-for-beginners/) (use the Terminal app on MacOS and Ubuntu, PuTTY or WSL on Windows).

![](/images/tlWg1YSqNjXRrarPjKobsnqTJ4.png)

This connects you to your new server. If you set a password when creating your VPS, enter it now.

Now copy the following into the terminal:

```bash
sudo apt update && sudo apt upgrade -y
```

If you're asked whether to keep or replace a configuration file, keep the current version. When the install finishes, run `sudo reboot now`. You'll get kicked out while the host restarts. After a couple of minutes, ssh back in and install some dependencies:

```bash
sudo apt install y podman podman-compose micro
```

Next, create a compose file with `micro compose.yml` and paste in the following:

```yaml
version: '3'
services:
  zooid:
    image: gitea.coracle.social/coracle/zooid
    restart: unless-stopped
    container_name: zooid
    volumes:
      - ./volumes/zooid/config:/app/config:U
      - ./volumes/zooid/media:/app/media:U
      - ./volumes/zooid/data:/app/data:U
    networks:
      - nginx
  nginx:
    image: docker.io/jonasal/nginx-certbot:6.0.1
    restart: unless-stopped
    container_name: nginx
    environment:
      CERTBOT_EMAIL: "your email here"
    ports:
      - 80:80
      - 443:443
    volumes:
      - ./volumes/nginx/letsencrypt:/etc/letsencrypt
      - ./volumes/nginx/user_conf.d:/etc/nginx/user_conf.d
    networks:
      - nginx
networks:
  nginx:
    driver: bridge
```

This defines a `zooid` service, your relay, plus an `nginx` service that exposes it to the public internet and provisions certificates. **Be sure to provide your real email address as **`CERTBOT_EMAIL`**.**

Hit `ctrl+s` and `ctrl+q` to save and exit. Then run `micro —mkparents volumes/nginx/user_conf.d/zooid.conf` and paste the following:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com;

    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl reuseport;
    listen [::]:443 ssl reuseport;
  
    server_name example.com;

    ssl_certificate         /etc/letsencrypt/live/zooid/fullchain.pem;
    ssl_certificate_key     /etc/letsencrypt/live/zooid/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/zooid/chain.pem;

    ssl_dhparam /etc/letsencrypt/dhparams/dhparam.pem;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location / {
        proxy_pass http://zooid:3334;
        proxy_read_timeout 86400;
    }
}
```

**Make sure to replace both instances of **`example.com`** with your actual domain name.** Again, hit `ctrl+s` and `ctrl+q` to save and exit.

The proxy header is `Host $http_host;` rather than the more commonly seen `Host $host;`. zooid is multi-tenant, and routes each incoming connection to the correct relay config by matching the `Host` header **exactly**, including the port if you're using a non-standard one. nginx's `$host` variable silently drops the port, while `$http_host` passes the original header through untouched. With `$host`, zooid may fail to match your relay to the request, and connections fail even though everything looks correctly configured.

Finally, configure zooid itself. For the full set of options, see [the readme](https://github.com/coracle-social/zooid). Run `micro —mkparents volumes/zooid/config/relay.toml` and paste in the following:

```toml
host = "relay.example.com"
schema = "relay"
secret = "<relay's hex private key>"

[info]
name = "My relay"
icon = "https://example.com/icon.png"
pubkey = "<owner's hex public key>"
description = "A community relay for my friends"

[groups]
enabled = true

[management]
enabled = true

[blossom]
enabled = true

[push]
enabled = true
```

Update the following values:

- `host` — your relay's domain name, **without** `https://` or a trailing slash
- `secret` — the relay's **hex private key**. You can generate one with `head -c 32 /dev/urandom | xxd -p | tr -d '\n'`. It must be **exactly 64 hex characters**. A shorter value doesn't produce an error. zooid silently left-pads it into a different, valid-looking key, and your relay boots with an identity you didn't intend.
- `name`, `icon`, and `description` populate the relay's metadata.
- `pubkey` is **your** Nostr public key. Whoever owns this key is the relay's admin.

Hit `ctrl+s` and `ctrl+q` to save and exit. You can now run `podman compose -d —build` to start your relay.

Check `podman compose logs` for errors. Invalid configuration files crash zooid, and DNS errors can make certbot fail. Once everything is running, you can close your terminal window and the server keeps running.

To test your connection, open Flotilla and click the compass icon in the sidebar:

![](/images/4yy0RuGdgZKQHNMutdvKIgZKbhs.png)

Enter your relay URL in the search bar and click the first result. If the connection status is green, your relay is set up correctly.

### Inviting Your First Members

The configuration above never mentions a `[policy]` block. **An empty or absent `[policy]` block makes your relay fully closed.** With the config as written, nobody but you can read or write to it, and nobody else can discover it or join.

Whoever's hex public key is set as `pubkey` under `[info]` always has full admin and invite rights, no matter what's in `[policy]` or `[roles]`. So you can open Flotilla, connect to your new relay, and either generate an invite link or add members directly by their Nostr public key. They'll be able to join even though the relay is otherwise closed to the public.

To run an open space that anyone can find and join without an invite, add a `[policy]` block to your `relay.toml` with `public_read = true` and `public_join = true`. Add `public_write = true` if you want non-members to be able to post. All three default to `false`.

For invite links, adding members by pubkey, and the difference between an invite-only and an open space, see [Controlling Who Can Join Your Space](/articles/controlling-space-access).

Keep your server up to date, secure, and backed up. See [Backing Up and Upgrading Your Self-Hosted Relay](/articles/backing-up-and-upgrading-a-relay) for zooid-specific guidance.

If you get stuck or have questions, [join our space](/articles/community-and-support) and we'll be happy to help.
