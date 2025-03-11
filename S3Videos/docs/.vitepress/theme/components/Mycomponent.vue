<script lang="ts" setup>
import MouseClick from "./MouseClick.vue";
import MouseFollower from "./MouseFollower.vue";
</script>

<template>
    <DefaultTheme.Layout>
     ...
      <template #layout-top>
        <MouseFollower />
        <MouseClick />
      </template>
      ...
    </DefaultTheme.Layout>
  </template>

<style>
/* 这里是CSS */
</style>