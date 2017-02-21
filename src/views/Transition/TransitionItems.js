// @flow
import React from 'react';

export type Metrics = {
  x: number,
  y: number,
  width: number,
  height: number,
}

export class TransitionItem {
  id: string;
  routeName: string;
  reactElement: React.Element<*>;
  nativeHandle: any;
  metrics: ?Metrics;
  constructor(id: string, routeName: string, reactElement: React.Element<*>, nativeHandle: any, metrics:?Metrics) {
    this.id = id;
    this.routeName = routeName;
    this.reactElement = reactElement;
    this.nativeHandle = nativeHandle;
    this.metrics = metrics;
  }
  clone() {
    return new TransitionItem(this.id, this.routeName, this.reactElement, this.nativeHandle, this.metrics);
  }
  toString() {
    return `${this.id} ${this.routeName} ${JSON.stringify(this.metrics)}`;
  }
}

type ItemPair = {
  fromItem: TransitionItem,
  toItem: TransitionItem,
};

export type UpdateRequest = {
  id: string,
  routeName: string,
  metrics: ?Metrics,
}

class TransitionItems {
  _items: Array<TransitionItem>;
  constructor(items: Array<TransitionItem> = []) {
    this._items = [...items];
  }
  _findIndex(id: string, routeName: string): number {
    return this._items.findIndex(i => {
      return i.id === id && i.routeName === routeName;
    });
  }
  count() {
    return this._items.length;
  }
  add(item: TransitionItem): TransitionItems {
    if (this._findIndex(item.id, item.routeName) >= 0)
      return this;
    else {
      return new TransitionItems([...this._items, item]);
    }
  }
  remove(id: string, routeName: string): TransitionItems {
    const index = this._findIndex(id, routeName);
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
      index: this._findIndex(r.id, r.routeName),
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
  _getIdPairMap(fromRoute: string, toRoute: string) {
    //TODO cache the map. Since the object is immutable, no need to worry about updates to _items
    const idMap = this._items.reduce((map, item) => {
      let pairByName = map.get(item.id);
      if (!pairByName) {
        pairByName = {};
        map.set(item.id, pairByName);
      }
      if (item.routeName === fromRoute) pairByName.fromItem = item;
      if (item.routeName === toRoute) pairByName.toItem = item;
      // delete empty pairs
      if (!pairByName.fromItem && !pairByName.toItem) map.delete(item.id);
      return map;
    }, new Map());
    return idMap;
  }
  isMeatured(p: ItemPair) {
    const isNumber = n => typeof n === 'number';
    const metricsValid = (m: Metrics) => m && [m.x, m.y, m.width, m.height].every(isNumber);
    const { fromItem, toItem } = p;
    return fromItem && toItem
      && metricsValid(fromItem.metrics) && metricsValid(toItem.metrics);
  }
  getMeasuredItemPairs(fromRoute: string, toRoute: string): Array<ItemPair> {
    const idMap = this._getIdPairMap(fromRoute, toRoute);
    // console.log('getMeasuredItemPairs.idMap', Array.from(idMap.values()).map(p => `fromItem:${p.fromItem ? p.fromItem.toString() : 'null'} toItem:${p.toItem ? p.toItem.toString() : 'null'}`));
    return Array.from(idMap.values())
      .filter(this.isMeatured);
  }
  findMatchByName(id: string, routeToExclude: string): ?TransitionItem {
    return this._items.find(i => i.id === id && i.routeName !== routeToExclude);
  }
}

export default TransitionItems;