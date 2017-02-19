// @flow
import React from 'react';

export type Metrics = {
  x: number,
  y: number,
  width: number,
  height: number,
}

export class TransitionItem {
  name: string;
  containerRouteName: string;
  reactElement: React.Element<*>;
  nativeHandle: any;
  metrics: ?Metrics;
  constructor(name: string, containerRouteName: string, reactElement: React.Element<*>, nativeHandle: any, metrics:?Metrics) {
    this.name = name;
    this.containerRouteName = containerRouteName;
    this.reactElement = reactElement;
    this.nativeHandle = nativeHandle;
    this.metrics = metrics;
  }
  clone() {
    return new TransitionItem(this.name, this.containerRouteName, this.reactElement, this.nativeHandle, this.metrics);
  }
  toString() {
    return `${this.name} ${this.containerRouteName} ${JSON.stringify(this.metrics)}`;
  }
}

type ItemPair = {
  fromItem: TransitionItem,
  toItem: TransitionItem,
};

export type UpdateRequest = {
  name: string,
  containerRouteName: string,
  metrics: ?Metrics,
}

class TransitionItems {
  _items: Array<TransitionItem>;
  constructor(items: Array<TransitionItem> = []) {
    this._items = [...items];
  }
  _findIndex(name: string, containerRouteName: string): number {
    return this._items.findIndex(i => {
      return i.name === name && i.containerRouteName === containerRouteName;
    });
  }
  count() {
    return this._items.length;
  }
  add(item: TransitionItem): TransitionItems {
    if (this._findIndex(item.name, item.containerRouteName) >= 0)
      return this;
    else {
      return new TransitionItems([...this._items, item]);
    }
  }
  remove(name: string, containerRouteName: string): TransitionItems {
    const index = this._findIndex(name, containerRouteName);
    if (index >= 0) {
      const newItems = [...this._items.slice(0, index), ...this._items.slice(index + 1)];
      return new TransitionItems(newItems);
    } else {
      return this;
    }
  }
  updateMetrics(requests: Array<UpdateRequest>): TransitionItems {
    const indexedRequests = requests.map(r => ({
      ...r,
      index: this._findIndex(r.name, r.containerRouteName),
    }));

    if (indexedRequests.every(r => r.index < 0)) return this;
    else {
      let newItems = Array.from(this._items);
      indexedRequests.forEach(r => {
        if (r.index >= 0) {
          const newItem = newItems[r.index].clone();
          newItem.metrics = r.metrics;
          newItems[r.index] = newItem;
        }
      });
      return new TransitionItems(newItems);
    }
  }

  removeAllMetrics(): TransitionItems {
    if (this._items.some(i => !!i.metrics)) {
      const newItems = this._items.map(item => {
        const newItem = item.clone();
        newItem.metrics = null;
        return newItem;
      });
      return new TransitionItems(newItems);
    } else return this;
  }
  _getNamePairMap(fromRoute: string, toRoute: string) {
    //TODO cache the map. Since the object is immutable, no need to worry about updates to _items
    const nameMap = this._items.reduce((map, item) => {
      let pairByName = map.get(item.name);
      if (!pairByName) {
        pairByName = {};
        map.set(item.name, pairByName);
      }
      if (item.containerRouteName === fromRoute) pairByName.fromItem = item;
      if (item.containerRouteName === toRoute) pairByName.toItem = item;
      // delete empty pairs
      if (!pairByName.fromItem && !pairByName.toItem) map.delete(item.name);
      return map;
    }, new Map());
    return nameMap;
  }
  isMeatured(p: ItemPair) {
    const isNumber = n => typeof n === 'number';
    const metricsValid = (m: Metrics) => m && [m.x, m.y, m.width, m.height].every(isNumber);
    const { fromItem, toItem } = p;
    return fromItem && toItem
      && metricsValid(fromItem.metrics) && metricsValid(toItem.metrics);
  }
  getMeasuredItemPairs(fromRoute: string, toRoute: string): Array<ItemPair> {
    const nameMap = this._getNamePairMap(fromRoute, toRoute);
    // console.log('getMeasuredItemPairs.nameMap', Array.from(nameMap.values()).map(p => `fromItem:${p.fromItem ? p.fromItem.toString() : 'null'} toItem:${p.toItem ? p.toItem.toString() : 'null'}`));
    return Array.from(nameMap.values())
      .filter(this.isMeatured);
  }
  findMatchByName(name: string, routeToExclude: string): ?TransitionItem {
    return this._items.find(i => i.name === name && i.containerRouteName !== routeToExclude);
  }
  areMetricsReadyForAllPairs(fromRoute: string, toRoute: string): boolean {
    const nameMap = this._getNamePairMap(fromRoute, toRoute);
    return Array.from(nameMap.values())
      .every(this.isMeatured);
  }
}

export default TransitionItems;