import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({
    customer_id,
    products,
  }: IRequest): Promise<Order | void> {
    const checkCustomerExists = await this.customersRepository.findById(
      customer_id,
    );

    if (!checkCustomerExists) {
      throw new AppError('This customer already exists');
    }

    const checkExistentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!checkExistentProducts.length) {
      throw new AppError('Could not find products with the given ids');
    }

    const existentProductsIds = checkExistentProducts.map(
      product => product.id,
    );

    const checkInexistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError('Could not find product');
    }

    const findProductsWithUnavailableQuantity = products.filter(
      product =>
        checkExistentProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithUnavailableQuantity.length) {
      throw new AppError('Quantity is unavailable');
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: checkExistentProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: checkCustomerExists,
      products: serializedProducts,
    });

    const { order_products } = order;

    const productsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        checkExistentProducts.filter(p => p.id === product.product_id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(productsQuantity);

    return order;
  }
}

export default CreateOrderService;
