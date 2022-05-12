function Counter(props) {
  const [count, setCount] = useState(0);
  const joe = {name: 'joe', age: 11};
  const ann = {name: 'ann', age: 32};
  const [user, setUser] = useState({name: 'joe', age: 11})
  return createElement(
    'h1',
    {
      onClick: () => {
        setCount(count => count + 1);
        setUser(u => u.name === 'joe' ? ann : joe);
      }
    },
    count,
    createElement(
      'div',
      null,
      'name: ',
      user.name,
    ),
    createElement(
      'div',
      null,
      'age: ',
      user.age
    )
  )
}

function App(props) {
  return createElement(
    'h3',
    {
      id: 'kosws',
      style: `color: red`
    },
    'adawd',
    2323,
    props.name,
    createElement('h4', null, 'yeah')
  )
}

const element = createElement(Counter, {
  name: 'joe'
})

const container = document.getElementById("app");

// 创建值为primitive value的元素对象
function createTextElement(text) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: []
    }
  }
}
// 创建一般元素对象
function createElement(type, props, ...children) {
  const ret = {};
  ret.type = type;
  ret.props = {
    ...props,
    children: children.map(child => (
      typeof child === 'object' ? child : createTextElement(child)
    ))
  }
  return ret;
}

// 下一个要执行的工作单元，一开始设为null，只要不为null就会在idleCallback里调用performWorkUnit处理
let nextWorkUnit = null;
// 旧Fiber Tree
let oldFiberRoot = null;
// 当创建DOM树开始时指向根节点，完成构建后调用commmitRoot从根节点开始挂载
let wipRoot = null;
let deletions = null;
// 调用render
render(element, container);
// 注册idleCallback
window.requestIdleCallback(workLoop);

// 为元素创建Fiber，供performWorkUnit处理
function Fiber({dom, father, firstChild, nextSibling, type, props, oldFiber, effectTag}) {
  this.dom = dom;
  this.father = father;
  this.firstChild = firstChild;
  this.nextSibling = nextSibling;
  this.type = type;
  this.props = props;
  this.oldFiber = oldFiber;
  this.effectTag = effectTag;
}


// 开始创建DOM树，将wipRoot、nextWorkUnit指向根节点对应的fiber
function render(element, container) {
  wipRoot = new Fiber(
    {
      dom: container,
      father: null,
      firstChild: null,
      nextSibling: null,
      type: null,
      props: {children: [element]},
      oldFiber: oldFiberRoot,
      effectTag: null
    }
  );
  deletions = [];
  nextWorkUnit = wipRoot;
}

// 浏览器空闲时会调用的函数
function workLoop(deadline) {
  let shouldYield = false; // 是否结束执行
  while (nextWorkUnit && !shouldYield) {
    nextWorkUnit = performWorkUnit(nextWorkUnit); // 执行工作单元
    shouldYield = deadline.timeRemaining() < 1 // 时间不够了就不执行下一个单元了
  }
  if (!nextWorkUnit && wipRoot) {
    commitRoot();
  }
  requestIdleCallback(workLoop); // 安排下一次idle时执行的函数
}

// 接收createTextElement、createElement的返回值，创建实际的DOM元素并返回
function createDom(element) {
  const node = (element.type === 'TEXT_ELEMENT') ? (
    document.createTextNode('')
  ) : (
    document.createElement(element.type)
  )
  updateDom(node, {}, element.props);
  return node;
}

// 处理fiber的函数
function performWorkUnit(fiber) {
  if (fiber.type instanceof Function) {
    handleFunctionFiber(fiber);
  } else {
    handleHostFiber(fiber);
  }
  if (fiber.firstChild) {
    return fiber.firstChild;
  } else if (fiber.nextSibling) {
    return fiber.nextSibling;
  } else {
    let father = fiber.father;
    while (father) {
      if (father.nextSibling) {
        return father.nextSibling;
      }
      father = father.father;
    }
    return null;
  }
}

let wipFiber = null;
let hookIndex = null;

function handleFunctionFiber(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];
  reconcileChildren(fiber, [fiber.type(fiber.props)]);
}

function useState(initialState) {
  /* 
    useState肯定是在函数组件中调用的
    而我们只在handleFunctionFiber中调用函数组件
    所以此时下面三条语句肯定已经执行完了：
      wipFiber = fiber;
      hookIndex = 0;
      wipFiber.hooks = [];
  */
  const oldHook = wipFiber.oldFiber && wipFiber.oldFiber.hooks && wipFiber.oldFiber.hooks[hookIndex];
  let currentState = oldHook ? oldHook.state : initialState;
  const currentHook = {
    state: currentState,
    actions: []
  }
  oldHook && oldHook.actions.forEach(action => action(currentHook));
  wipFiber.hooks.push(currentHook);
  function setState(setFunc) {
    let newState = setFunc(currentHook.state);
    if (newState !== currentHook.state) {
      currentHook.actions.push(ch => {
        ch.state = newState;
      })
      wipRoot = new Fiber({
        dom: wipFiber.dom,
        props: wipFiber.props,
        oldFiber: wipFiber,
        type: wipFiber.type,
        props: wipFiber.props,
        father: wipFiber.father,
        nextSibling: wipFiber.nextSibling
      });
      nextWorkUnit = wipRoot;
    }
  }
  hookIndex++;
  return [currentHook.state, setState]
}

function handleHostFiber(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props.children);
}
function reconcileChildren(fiber, children) {
  let oldFiber = fiber.oldFiber && fiber.oldFiber.firstChild;
  let index = 0;
  let lastFiber = null;
  while (index < children.length || oldFiber) {
    const currentChild = children[index];
    let currentFiber = null;
    if (currentChild) {
      currentFiber = new Fiber({
        type: currentChild.type,
        props: currentChild.props,
        father: fiber,
      });
    }
    if (!oldFiber) {
      //新Fiber树中出现新的节点
      currentFiber.effectTag = 'NEW';
      currentFiber.oldFiber = null;
    } else if (!currentChild) {
      // 新Fiber树中发现有的节点不见了
      oldFiber.effectTag = 'DELETE';
      deletions.push(oldFiber);  
    } else if (oldFiber.type === currentChild.type) {
      // 新Fiber树中发现节点和老的节点类型相同，复用Dom元素，更新属性就好
      currentFiber.dom = oldFiber.dom;
      currentFiber.effectTag = 'UPDATE';
      currentFiber.oldFiber = oldFiber;
    } else {
      // 新Fiber树中发现节点和老的节点类型不同，要进行更换 
      currentFiber.dom = null;
      currentFiber.effectTag = 'NEW';
      currentFiber.oldFiber = null;
      oldFiber.effectTag = 'DELETE';
      deletions.push(oldFiber); 
    }
    if (index === 0) {
      fiber.firstChild = currentFiber;
    }
    if (lastFiber) {
      lastFiber.nextSibling = currentFiber;
    }
    lastFiber = currentFiber;
    index++;
    if (oldFiber) {
      oldFiber = oldFiber.nextSibling;
    }
  }
}

function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.firstChild);
  oldFiberRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }
  let fatherFiberWithDom = fiber.father;
  while (!fatherFiberWithDom.dom) {
    fatherFiberWithDom = fatherFiberWithDom.father;
  }
  if (fiber.effectTag === 'DELETE')  {
    let deleteFiber = fiber;
    while (!deleteFiber.dom) {
      deleteFiber = deleteFiber.firstChild;
    }
    fatherFiberWithDom.dom.remove(deleteFiber.dom);
  } else if (fiber.effectTag === 'NEW' && fiber.dom) {
    fatherFiberWithDom.dom.appendChild(fiber.dom);
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom) {
    updateDom(
      fiber.dom,
      fiber.oldFiber.props,
      fiber.props
    )
  }
  commitWork(fiber.firstChild);
  commitWork(fiber.nextSibling);
}

function updateDom(dom, preProps, newProps) {
  const isProperty = key => key !== 'children';
  const differentKey = key => newProps[key] !== preProps[key];
  const goneKey = key => !Object.keys(newProps).includes(key);
  const isOn = key => key.startsWith('on');
  Object.keys(newProps).filter(isProperty).filter(differentKey).filter(key => !isOn(key)).forEach(key => {
    dom[key] = newProps[key];
  })
  Object.keys(preProps).filter(isProperty).filter(goneKey).filter(key => !isOn(key)).forEach(key => {
    dom[key] = '';
  })
  Object.keys(newProps).filter(isProperty).filter(differentKey).filter(isOn).forEach(key => {
    const event = key.toLowerCase().substring(2);
    dom.removeEventListener(event, preProps[key]);
    dom.addEventListener(event, newProps[key]);
  })
  Object.keys(preProps).filter(isProperty).filter(goneKey).filter(isOn).forEach(key => {
    const event = key.toLowerCase().substring(2);
    dom.removeEventListener(event, preProps[key]);
  })
}