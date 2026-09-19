import { validateResources } from './resource-schema.js';

const RESOURCE_API = '/api/resources';

const clone = (value) => JSON.parse(JSON.stringify(value));

function createField(labelText, value, { type = 'text', step, min, disabled = false } = {}) {
  const label = document.createElement('label');
  label.className = 'resource-field';
  label.innerText = labelText;
  const input = document.createElement('input');
  input.type = type;
  input.value = value ?? '';
  if (step) input.step = step;
  if (min !== undefined) input.min = min;
  input.disabled = disabled;
  label.append(input);
  return { label, input };
}

function createSelectField(labelText, value, options) {
  const label = document.createElement('label');
  label.className = 'resource-field';
  label.innerText = labelText;
  const select = document.createElement('select');
  options.forEach(([optionValue, optionLabel]) => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.innerText = optionLabel;
    option.selected = optionValue === value;
    select.append(option);
  });
  label.append(select);
  return { label, input: select };
}

function createAssetEditor(resources, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'resource-assets';
  const title = document.createElement('p');
  title.className = 'resource-subtitle';
  title.innerText = '基础资源路径';
  wrapper.append(title);

  Object.entries(resources.assets).forEach(([key, value]) => {
    const field = createField(key, value);
    field.input.addEventListener('change', () => onChange((draft) => {
      draft.assets[key] = field.input.value.trim();
    }));
    wrapper.append(field.label);
  });

  return wrapper;
}

function createFruitEditor(fruit, allFruits, onChange, onRemove) {
  const card = document.createElement('article');
  card.className = 'resource-fruit';
  const heading = document.createElement('div');
  heading.className = 'resource-fruit-heading';
  const title = document.createElement('strong');
  title.innerText = fruit.name || fruit.id;
  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'resource-remove';
  removeButton.innerText = '移除';
  removeButton.addEventListener('click', onRemove);
  heading.append(title, removeButton);
  card.append(heading);

  const grid = document.createElement('div');
  grid.className = 'resource-fields';
  const renderMode = createSelectField('显示类型', fruit.renderMode || 'texture', [
    ['texture', '图片纹理'],
    ['color', '纯色文字球'],
  ]);
  renderMode.input.addEventListener('change', () => onChange((draft) => {
    draft.fruits.find((item) => item.id === fruit.id).renderMode = renderMode.input.value;
  }));
  grid.append(renderMode.label);

  const fields = [
    ['名称', 'name', { disabled: false }],
    ['展示文字', 'text', { disabled: false }],
    ['球体颜色', 'color', { type: 'color', disabled: false }],
    ['文字颜色', 'textColor', { type: 'color', disabled: false }],
    ['图片路径', 'texture', { disabled: false }],
    ['音效路径', 'popSound', { disabled: false }],
    ['半径', 'radius', { type: 'number', step: '1', min: 1 }],
    ['分数', 'score', { type: 'number', step: '1', min: 0 }],
  ];

  fields.forEach(([label, key, options]) => {
    const field = createField(label, fruit[key], options);
    field.input.addEventListener('change', () => onChange((draft) => {
      const nextValue = options.type === 'number' ? Number(field.input.value) : field.input.value.trim();
      draft.fruits.find((item) => item.id === fruit.id)[key] = nextValue;
    }));
    grid.append(field.label);
  });

  const mergeLabel = document.createElement('label');
  mergeLabel.className = 'resource-field';
  mergeLabel.innerText = '合成目标';
  const mergeSelect = document.createElement('select');
  mergeSelect.innerHTML = '<option value="">不合成</option>';
  allFruits.filter((item) => item.id !== fruit.id).forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.innerText = item.name || item.id;
    option.selected = item.id === fruit.mergeTo;
    mergeSelect.append(option);
  });
  mergeSelect.addEventListener('change', () => onChange((draft) => {
    draft.fruits.find((item) => item.id === fruit.id).mergeTo = mergeSelect.value || null;
  }));
  mergeLabel.append(mergeSelect);
  grid.append(mergeLabel);

  const spawnLabel = document.createElement('label');
  spawnLabel.className = 'resource-toggle';
  const spawnInput = document.createElement('input');
  spawnInput.type = 'checkbox';
  spawnInput.checked = fruit.spawnable !== false;
  spawnInput.addEventListener('change', () => onChange((draft) => {
    draft.fruits.find((item) => item.id === fruit.id).spawnable = spawnInput.checked;
  }));
  spawnLabel.append(spawnInput, document.createTextNode('允许随机出现'));
  grid.append(spawnLabel);
  card.append(grid);

  return card;
}

export function initResourceEditor(initialResources) {
  const form = document.getElementById('resource-editor');
  const toggle = document.getElementById('resource-editor-toggle');
  const list = document.getElementById('resource-fruit-list');
  const assets = document.getElementById('resource-asset-list');
  const addButton = document.getElementById('resource-add-fruit');
  const status = document.getElementById('resource-save-status');
  if (!form || !toggle || !list || !assets || !addButton || !status) return;

  let draft = clone(initialResources);
  draft.fruits = draft.fruits.map((fruit) => ({
    renderMode: 'texture',
    color: '#d8c7ff',
    text: '',
    textColor: '#202124',
    ...fruit,
  }));

  const setStatus = (message, isError = false) => {
    status.innerText = message;
    status.dataset.error = isError ? 'true' : 'false';
  };

  const updateDraft = (mutate) => {
    mutate(draft);
  };

  const render = () => {
    assets.replaceChildren(createAssetEditor(draft, updateDraft));
    list.replaceChildren();
    draft.fruits.forEach((fruit) => {
      list.append(createFruitEditor(
        fruit,
        draft.fruits,
        updateDraft,
        () => {
          if (draft.fruits.length <= 1) {
            setStatus('至少保留一个水果。', true);
            return;
          }
          draft.fruits = draft.fruits.filter((item) => item.id !== fruit.id);
          draft.fruits.forEach((item) => {
            if (item.mergeTo === fruit.id) item.mergeTo = null;
          });
          render();
        },
      ));
    });
  };

  toggle.addEventListener('click', () => {
    const isHidden = form.hasAttribute('hidden');
    if (isHidden) {
      form.removeAttribute('hidden');
      toggle.innerText = '收起配置';
      render();
    } else {
      form.setAttribute('hidden', '');
      toggle.innerText = '打开编辑器';
    }
  });

  addButton.addEventListener('click', () => {
    const index = draft.fruits.length;
    draft.fruits.push({
      id: `custom-${index + 1}`,
      name: `新水果 ${index + 1}`,
      renderMode: 'color',
      color: '#d8c7ff',
      text: String(index + 1),
      textColor: '#202124',
      radius: 48,
      score: 1,
      texture: 'assets/img/circle0.png',
      popSound: 'assets/pop0.mp3',
      mergeTo: null,
      spawnable: true,
    });
    render();
    setStatus('已添加草稿水果，请填写资源路径。');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      validateResources(draft);
      const response = await fetch(RESOURCE_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存失败');
      setStatus('已保存，刷新页面后生效。');
    } catch (error) {
      setStatus(error.message || '保存失败，请检查配置。', true);
    }
  });

  setStatus('配置来源：resources.json');
}
