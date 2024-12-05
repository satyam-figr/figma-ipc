// create a no operation function
// no operation functions returns undefined
const noOperationFunction = () => {
  return undefined;
};

export class DeferredPromise<T> implements Promise<T> {
  // private variable to store the created promise
  private _promise: Promise<T>;

  resolve: (value: T | PromiseLike<T>) => void = noOperationFunction;
  reject: (reason?: any) => void = noOperationFunction;
  constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined
  ): Promise<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined
  ): Promise<T | TResult> {
    return this._promise.catch(onrejected);
  }

  finally(onFinally?: (() => void) | undefined | null) {
    return this._promise.finally(onFinally);
  }
}
