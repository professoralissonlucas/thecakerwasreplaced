while True:
    for i in range(tamanho()):
        for j in range(tamanho()):
            if esta_pronto():
                retirar()
            if estado() == "vazio":
                assar("bolo")
            mover(Norte)
        mover(Leste)
