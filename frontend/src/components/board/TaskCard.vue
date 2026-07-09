<script setup lang="ts">
import type { Task } from '../../types';
import { computed } from 'vue';

const props = defineProps<{
  task: Task;
}>();

const emit = defineEmits<{
  click: [taskId: number];
}>();

const plainDescription = computed(() => {
  if (!props.task.description) return '';
  return props.task.description.replace(/<[^>]*>/g, '').trim();
});
</script>

<template>
  <div
    class="bg-white rounded-sm shadow-card px-3 py-3 min-h-28 flex flex-col cursor-pointer transition-shadow duration-150 hover:shadow-popover focus-visible:ring-2 focus-visible:ring-gray-1000 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    tabindex="0"
    @click="emit('click', task.id)"
    @keydown.enter="emit('click', task.id)"
  >
    <p class="text-sm font-medium text-gray-1000 leading-5 line-clamp-2">
      {{ task.title }}
    </p>
    <p v-if="plainDescription" class="mt-1 text-sm leading-relaxed text-gray-900 line-clamp-2">
      {{ plainDescription }}
    </p>
    <div class="mt-auto flex items-center justify-between gap-2">
      <p v-if="task.dueDate" class="text-[13px] font-light leading-relaxed text-slate-950 truncate">
        Due
        {{
          new Date(task.dueDate).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        }}
      </p>
      <span
        v-if="task.priority"
        class="shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-none text-white"
        :class="{
          'bg-amber-400': task.priority === 'LOW',
          'bg-emerald-400': task.priority === 'MEDIUM',
          'bg-rose-400': task.priority === 'HIGH',
        }"
      >
        {{ task.priority.charAt(0) + task.priority.slice(1).toLowerCase() }}
      </span>
    </div>
  </div>
</template>
