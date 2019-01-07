<template>
  <div></div>
</template>

<script>

export default {
  name: 'LoadingSpinner'
}
</script>

<style scoped>
div {
  box-sizing: border-box;
  padding-bottom: calc(50% - 16px);
  width: 50%;
  border-radius: 50%;
  border: 8px dashed white;
  animation: load 3s infinite linear;
  overflow: hidden;
}

@keyframes load {
  0% {
    tranform: rotate(0deg);
    opacity: 1;
  }
  25% { opacity: 0.4; }
  50% { opacity: 1.0; width: 40%; padding-bottom: calc(40% - 16px); }
  75% { opacity: 0.4; }
  100% {
    transform: rotate(360deg);
    opacity: 1;
  }
}
</style>
