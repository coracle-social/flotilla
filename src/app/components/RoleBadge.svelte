<script lang="ts">
  import cx from "classnames"
  import type {RelayRoleReader} from "@welshman/domain"
  import {roleColor} from "@app/features/roles"

  type Props = {
    role: RelayRoleReader
    size?: "sm" | "md"
  }

  const {role, size = "sm"}: Props = $props()
</script>

<span
  class={cx("role-badge", size === "md" && "role-badge--md")}
  style="--role-color: {roleColor(role.color() ?? 0)}">
  <span class="role-badge__dot" aria-hidden="true"></span>
  {role.label() || "Untitled Role"}
</span>
