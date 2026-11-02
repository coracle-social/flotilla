---
title: "Getting Started"
author: "Jon Staab"
pubDate: 2026-07-14
slug: getting-started
source: https://flotilla.social/articles/getting-started
description: "Two ways to create a Flotilla account — a simple email sign-up or generating your own key — plus how to log in with an existing profile."
order: 2
category: basics
---

# Getting Started

*Part of our guide to [running an online community you actually own](/articles/how-to-run-an-online-community).*

To get started, visit [app.flotilla.social](https://app.flotilla.social). You'll see two choices: **Log in**, if you've been here before, or **Create an account**, if you're new.

Click **Create an account** and you'll be offered two ways to sign up: the quick way, with an email and password, or by generating your own key. They lead to the same place. The difference is who looks after your account's key, and you can switch later.

## Sign up with email

An email sign-up still creates a real Nostr identity for you. Flotilla splits the key across several servers and locks it with your password.

1. On the "Join Flotilla" screen, choose **Sign up with email**.
2. Enter your **email address** and a **password** (at least 12 characters).
3. Check your inbox for a **one-time confirmation code** and enter it to verify your email.
4. Fill out your **profile** — a name, a picture, a short bio, all optional — then continue.

From then on you can sign in on any device with your email and password, or with a one-time code if you forget it.

## Generate your own key

This path gives you a **key** that belongs to you, so no one can lock you out or take your identity away. (See [Understanding Your Nostr Identity](/articles/understanding-your-nostr-identity) for what that key is.)

1. On the "Join Flotilla" screen, choose **Generate a key**. Flotilla creates a new key and stores it in your browser.
2. Fill out your **profile** — a name, a picture, a short bio, all optional — then continue.
3. On the "Your Keys are Ready!" screen, click **Download my key** to save a backup file. For extra protection, choose **"I want to download an encrypted version"** and set a password (at least 12 characters) first. You have to download the key before you can move on.

Keep that file somewhere safe, like a password manager. [Bitwarden](https://bitwarden.com/) is a good free option. Your key *is* your account. There's no "forgot password" reset, and if you lose it or it's stolen you lose access to your identity for good. The backup also lets you log in to other [Nostr apps](https://nostrapps.com) with the same profile.

## Already have an account?

If you've used Flotilla or another Nostr app before, choose **Log in** on the welcome screen instead and bring your existing key in. Some ways of doing that are safer than others — see [Ways to Log In to Flotilla](/articles/logging-in-to-flotilla) for the options, and [Understanding Your Nostr Identity](/articles/understanding-your-nostr-identity) for the bigger picture.

## Next steps

However you signed up, you'll land on your dashboard. From there you can [join a space](/articles/joining-a-space) someone has invited you to, or [start one of your own](/articles/hosting-with-flotilla).
