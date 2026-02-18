#!/usr/bin/env zsh

onchange src -ik -- npx svelte-kit sync &

onchange src -ik -- bash -c 'unbuffer npx svelte-check --tsconfig ./tsconfig.json | less -R' &

wait
